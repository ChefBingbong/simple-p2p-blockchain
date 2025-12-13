import { CODE_P2P } from '@multiformats/multiaddr'
import { anySignal, ClearableSignal } from 'any-signal'
import { setMaxListeners } from 'main-event'
import { ConnectionEncrypter } from '../connection-encrypters/eccies/types'
import * as mss from '../multi-stream-select'
import { MplexStreamMuxer, StreamMuxerFactory } from '../muxer'
import { AbstractMessageStream } from '../stream/default-message-stream'
import { AbstractMultiaddrConnection } from './abstract-multiaddr-connection'
import { Connection, createConnection } from './connection'
import { Registrar } from './registrar'
import { AbortOptions, PeerId } from './types'

interface CreateConnectionOptions {
  id: string
  cryptoProtocol: string
  direction: 'inbound' | 'outbound'
  maConn: AbstractMultiaddrConnection
  stream: AbstractMessageStream
  remotePeer: PeerId
  muxer?: MplexStreamMuxer
  closeTimeout?: number
}

export interface SecuredConnection {
  connection: AbstractMessageStream
  remotePeer: PeerId
  protocol: string
}

export interface UpgraderInit {
  privateKey: Uint8Array
  id: Uint8Array
  connectionEncrypter: ConnectionEncrypter
  streamMuxerFactory: StreamMuxerFactory
  inboundUpgradeTimeout?: number
  inboundStreamProtocolNegotiationTimeout?: number
  outboundStreamProtocolNegotiationTimeout?: number
  connectionCloseTimeout?: number
}

export interface UpgraderComponents {
  registrar: Registrar
}

export const INBOUND_UPGRADE_TIMEOUT = 10_000
export const PROTOCOL_NEGOTIATION_TIMEOUT = 10_000
export const CONNECTION_CLOSE_TIMEOUT = 1_000

export class Upgrader {
  private readonly connectionEncrypter: ConnectionEncrypter
  private readonly streamMuxerFactory: StreamMuxerFactory
  private readonly inboundUpgradeTimeout: number
  private readonly inboundStreamProtocolNegotiationTimeout: number
  private readonly outboundStreamProtocolNegotiationTimeout: number
  private readonly connectionCloseTimeout: number
  private readonly components: UpgraderComponents
  private readonly privateKey: Uint8Array
  private readonly id: Uint8Array

  constructor (components: UpgraderComponents, init: UpgraderInit) {
    this.components = components
    this.privateKey = init.privateKey
    this.id = init.id
    this.connectionEncrypter = init.connectionEncrypter
    this.streamMuxerFactory = init.streamMuxerFactory

    this.inboundUpgradeTimeout = init.inboundUpgradeTimeout ?? INBOUND_UPGRADE_TIMEOUT
    this.inboundStreamProtocolNegotiationTimeout = init.inboundStreamProtocolNegotiationTimeout ?? PROTOCOL_NEGOTIATION_TIMEOUT
    this.outboundStreamProtocolNegotiationTimeout = init.outboundStreamProtocolNegotiationTimeout ?? PROTOCOL_NEGOTIATION_TIMEOUT
    this.connectionCloseTimeout = init.connectionCloseTimeout ?? CONNECTION_CLOSE_TIMEOUT
  }

  createInboundAbortSignal (signal?: AbortSignal): ClearableSignal {
    const signals: AbortSignal[] = [AbortSignal.timeout(this.inboundUpgradeTimeout)]
    if (signal) {
      signals.push(signal)
    }
    const output = anySignal(signals)
    setMaxListeners(Infinity, output)
    return output
  }

  async upgradeInbound (maConn: AbstractMultiaddrConnection, opts: { signal?: AbortSignal } = {}): Promise<Connection> {
    const signal = this.createInboundAbortSignal(opts.signal)

    try {
      return await this._performUpgrade(maConn, 'inbound', { signal })
    } finally {
      signal.clear()
    }
  }

  async upgradeOutbound (maConn: AbstractMultiaddrConnection, opts: { signal?: AbortSignal } = {}): Promise<Connection> {
    return await this._performUpgrade(maConn, 'outbound', opts)
  }

  private async _performUpgrade (
    maConn: AbstractMultiaddrConnection, 
    direction: 'inbound' | 'outbound',
    opts: AbortOptions = {}
  ): Promise<Connection> {
    let stream: AbstractMessageStream = maConn
    let remotePeer: PeerId
    let muxer: MplexStreamMuxer | undefined
    let cryptoProtocol: string

    const id = `${(parseInt(String(Math.random() * 1e9))).toString(36)}${Date.now()}`

    try {
      // Try to extract remote peer ID from multiaddr
      const peerIdString = maConn.remoteAddr.getComponents().findLast(c => c.code === CODE_P2P)?.value

      // Encrypt the connection
      const encrypted = direction === 'inbound'
        ? await this._encryptInbound(stream, opts)
        : await this._encryptOutbound(stream, opts)

      stream = encrypted.connection
      remotePeer = encrypted.remotePeer
      cryptoProtocol = encrypted.protocol

      // If we had a peer ID in the multiaddr, we could verify it matches here
      // For now we trust the encrypted connection's peer ID

      // Multiplex the connection
      const muxerFactory = await (direction === 'inbound'
        ? this._multiplexInbound(stream, opts)
        : this._multiplexOutbound(stream, opts))

      maConn.log('create muxer %s', muxerFactory.protocol)
      muxer = muxerFactory.createStreamMuxer(stream)

    } catch (err: any) {
      maConn.log.error('failed to upgrade %s connection %s %s - %s', direction, direction === 'inbound' ? 'from' : 'to', maConn.remoteAddr.toString(), err.message)
      throw err
    }

    return this._createConnection({
      id,
      cryptoProtocol,
      direction,
      maConn,
      stream,
      muxer,
      remotePeer,
      closeTimeout: this.connectionCloseTimeout
    })
  }

  /**
   * A convenience method for generating a new `Connection`
   */
  _createConnection (opts: CreateConnectionOptions): Connection {
    const connection = createConnection(this.components, {
      ...opts,
      outboundStreamProtocolNegotiationTimeout: this.outboundStreamProtocolNegotiationTimeout,
      inboundStreamProtocolNegotiationTimeout: this.inboundStreamProtocolNegotiationTimeout
    })

    return connection
  }

  /**
   * Encrypts the incoming connection
   */
  async _encryptInbound (connection: AbstractMessageStream, options: AbortOptions): Promise<SecuredConnection> {
    const protocols = [this.connectionEncrypter.protocol]

    try {
      const protocol = await mss.handle(connection, protocols, options)

      connection.log('encrypting inbound connection using %s', protocol)

      // Perform actual ECIES encryption handshake
      const maConn = connection as any
      const socket = maConn.socket
      if (!socket) {
        throw new Error('No socket available for ECIES encryption')
      }

      connection.log('performing ECIES handshake (inbound)...')
      const secureConn = await this.connectionEncrypter.secureInBound(socket)
      
      connection.log('ECIES handshake complete (inbound), remote peer: %s', Buffer.from(secureConn.remotePeer).toString('hex').slice(0, 16))

      return {
        connection,
        remotePeer: secureConn.remotePeer,
        protocol
      }
    } catch (err: any) {
      throw new Error(`Failed to encrypt inbound connection: ${err.message}`)
    }
  }

  /**
   * Encrypts the outgoing connection
   */
  async _encryptOutbound (connection: AbstractMessageStream, options: AbortOptions): Promise<SecuredConnection> {
    const protocols = [this.connectionEncrypter.protocol]

    try {
      connection.log.trace('selecting encrypter from %s', protocols)

      const protocol = await mss.select(connection, protocols, options)

      connection.log('encrypting outbound connection using %s', protocol)

      // Perform actual ECIES encryption handshake
      const maConn = connection as any
      const socket = maConn.socket
      if (!socket) {
        throw new Error('No socket available for ECIES encryption')
      }

      // For outbound, we need the remote peer ID that was passed to the transport
      const remotePeerId = maConn.remotePeerId
      if (!remotePeerId) {
        throw new Error('No remote peer ID available for ECIES encryption')
      }

      connection.log('performing ECIES handshake (outbound) with peer %s...', Buffer.from(remotePeerId).toString('hex').slice(0, 16))
      const secureConn = await this.connectionEncrypter.secureOutBound(socket, remotePeerId)
      
      connection.log('ECIES handshake complete (outbound), remote peer: %s', Buffer.from(secureConn.remotePeer).toString('hex').slice(0, 16))

      return {
        connection,
        remotePeer: secureConn.remotePeer,
        protocol
      }
    } catch (err: any) {
      throw new Error(`Failed to encrypt outbound connection: ${err.message}`)
    }
  }

  /**
   * Selects one of the given muxers via multistream-select for outbound
   */
  async _multiplexOutbound (maConn: AbstractMessageStream, options: AbortOptions): Promise<StreamMuxerFactory> {
    const protocols = [this.streamMuxerFactory.protocol]

    try {
      const protocol = await mss.select(maConn, protocols, options)

      if (protocol !== this.streamMuxerFactory.protocol) {
        throw new Error(`No muxer configured for protocol "${protocol}"`)
      }

      return this.streamMuxerFactory
    } catch (err: any) {
      throw new Error(`Failed to negotiate muxer: ${err.message}`)
    }
  }

  /**
   * Registers support for one of the given muxers via multistream-select for inbound
   */
  async _multiplexInbound (maConn: AbstractMessageStream, options: AbortOptions): Promise<StreamMuxerFactory> {
    const protocols = [this.streamMuxerFactory.protocol]

    try {
      const protocol = await mss.handle(maConn, protocols, options)

      if (protocol !== this.streamMuxerFactory.protocol) {
        throw new Error(`No muxer configured for protocol "${protocol}"`)
      }

      return this.streamMuxerFactory
    } catch (err: any) {
      throw new Error(`Failed to negotiate muxer: ${err.message}`)
    }
  }

  getConnectionEncrypter (): ConnectionEncrypter {
    return this.connectionEncrypter
  }

  getStreamMuxerFactory (): StreamMuxerFactory {
    return this.streamMuxerFactory
  }
}

export function createUpgrader (components: UpgraderComponents, init: UpgraderInit): Upgrader {
  return new Upgrader(components, init)
}
