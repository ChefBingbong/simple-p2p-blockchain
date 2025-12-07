import type { ChainConfig } from './types.ts'

// All chains simplified to only Chainstart hardfork with PoW consensus

export const Mainnet: ChainConfig = {
  name: 'mainnet',
  chainId: 1,
  defaultHardfork: 'chainstart',
  consensus: {
    type: 'pow',
    algorithm: 'ethash',
    ethash: {},
  },
  comment: 'The Ethereum main chain',
  url: 'https://ethstats.net/',
  genesis: {
    gasLimit: 5000,
    difficulty: 17179869184,
    nonce: '0x0000000000000042',
    extraData: '0x11bbe8db4e347b4e8c937c1c8370e4b5ed33adb3db69cbdb7a38e1e50b1b82fa',
  },
  hardforks: [
    {
      name: 'chainstart',
      block: 0,
      forkHash: '0xfc64ec04',
    },
  ],
  bootstrapNodes: [
    {
      ip: '18.138.108.67',
      port: 30303,
      id: 'd860a01f9722d78051619d1e2351aba3f43f943f6f00718d1b9baa4101932a1f5011f16bb2b1bb35db20d6fe28fa0bf09636d26a87d31de9ec6203eeedb1f666',
      location: 'ap-southeast-1-001',
      comment: 'bootnode-aws-ap-southeast-1-001',
    },
    {
      ip: '3.209.45.79',
      port: 30303,
      id: '22a8232c3abc76a16ae9d6c3b164f98775fe226f0917b0ca871128a74a8e9630b458460865bab457221f1d448dd9791d24c4e5d88786180ac185df813a68d4de',
      location: 'us-east-1-001',
      comment: 'bootnode-aws-us-east-1-001',
    },
    {
      ip: '65.108.70.101',
      port: 30303,
      id: '2b252ab6a1d0f971d9722cb839a42cb81db019ba44c08754628ab4a823487071b5695317c8ccd085219c3a03af063495b2f1da8d18218da2d6a82981b45e6ffc',
      location: 'eu-west-1-001',
      comment: 'bootnode-hetzner-hel',
    },
    {
      ip: '157.90.35.166',
      port: 30303,
      id: '4aeb4ab6c14b23e2c4cfdce879c04b0748a20d8e9b59e25ded2a08143e265c6c25936e74cbc8e641e3312ca288673d91f2f93f8e277de3cfa444ecdaaf982052',
      location: 'eu-central-1-001',
      comment: 'bootnode-hetzner-fsn',
    },
  ],
  dnsNetworks: [
    'enrtree://AKA3AM6LPBYEUDMVNU3BSVQJ5AD45Y7YPOHJLEF6W26QOE4VTUDPE@all.mainnet.ethdisco.net',
  ],
}

export const Sepolia: ChainConfig = {
  name: 'sepolia',
  chainId: 11155111,
  defaultHardfork: 'chainstart',
  consensus: {
    type: 'pow',
    algorithm: 'ethash',
    ethash: {},
  },
  comment: 'PoW test network',
  url: 'https://github.com/ethereum/go-ethereum/pull/23730',
  genesis: {
    timestamp: '0x6159af19',
    gasLimit: 30000000,
    difficulty: 131072,
    nonce: '0x0000000000000000',
    extraData: '0x5365706f6c69612c20417468656e732c204174746963612c2047726565636521',
  },
  hardforks: [
    {
      name: 'chainstart',
      block: 0,
      forkHash: '0xfe3366e7',
    },
  ],
  bootstrapNodes: [
    {
      ip: '18.168.182.86',
      port: 30303,
      id: '9246d00bc8fd1742e5ad2428b80fc4dc45d786283e05ef6edbd9002cbc335d40998444732fbe921cb88e1d2c73d1b1de53bae6a2237996e9bfe14f871baf7066',
      location: '',
      comment: 'geth',
    },
    {
      ip: '52.14.151.177',
      port: 30303,
      id: 'ec66ddcf1a974950bd4c782789a7e04f8aa7110a72569b6e65fcd51e937e74eed303b1ea734e4d19cfaec9fbff9b6ee65bf31dcb50ba79acce9dd63a6aca61c7',
      location: '',
      comment: 'besu',
    },
    {
      ip: '165.22.196.173',
      port: 30303,
      id: 'ce970ad2e9daa9e14593de84a8b49da3d54ccfdf83cbc4fe519cb8b36b5918ed4eab087dedd4a62479b8d50756b492d5f762367c8d20329a7854ec01547568a6',
      location: '',
      comment: 'EF',
    },
    {
      ip: '65.108.95.67',
      port: 30303,
      id: '075503b13ed736244896efcde2a992ec0b451357d46cb7a8132c0384721742597fc8f0d91bbb40bb52e7d6e66728d36a1fda09176294e4a30cfac55dcce26bc6',
      location: '',
      comment: 'lodestar',
    },
  ],
  dnsNetworks: [
    'enrtree://AKA3AM6LPBYEUDMVNU3BSVQJ5AD45Y7YPOHJLEF6W26QOE4VTUDPE@all.sepolia.ethdisco.net',
  ],
}

export const Holesky: ChainConfig = {
  name: 'holesky',
  chainId: 17000,
  defaultHardfork: 'chainstart',
  consensus: {
    type: 'pow',
    algorithm: 'ethash',
    ethash: {},
  },
  comment: 'PoW test network',
  url: 'https://github.com/eth-clients/holesky/',
  genesis: {
    difficulty: '0x01',
    extraData: '0x',
    gasLimit: '0x17D7840',
    nonce: '0x0000000000001234',
    timestamp: '0x65156994',
  },
  hardforks: [
    {
      name: 'chainstart',
      block: 0,
      forkHash: '0xc61a6098',
    },
  ],
  bootstrapNodes: [
    {
      ip: '146.190.13.128',
      port: 30303,
      id: 'ac906289e4b7f12df423d654c5a962b6ebe5b3a74cc9e06292a85221f9a64a6f1cfdd6b714ed6dacef51578f92b34c60ee91e9ede9c7f8fadc4d347326d95e2b',
      location: '',
      comment: 'bootnode 1',
    },
    {
      ip: '178.128.136.233',
      port: 30303,
      id: 'a3435a0155a3e837c02f5e7f5662a2f1fbc25b48e4dc232016e1c51b544cb5b4510ef633ea3278c0e970fa8ad8141e2d4d0f9f95456c537ff05fdf9b31c15072',
      location: '',
      comment: 'bootnode 2',
    },
  ],
  dnsNetworks: [
    'enrtree://AKA3AM6LPBYEUDMVNU3BSVQJ5AD45Y7YPOHJLEF6W26QOE4VTUDPE@all.holesky.ethdisco.net',
  ],
}

export const Hoodi: ChainConfig = {
  name: 'hoodi',
  chainId: 560048,
  defaultHardfork: 'chainstart',
  consensus: {
    type: 'pow',
    algorithm: 'ethash',
    ethash: {},
  },
  comment: 'PoW test network',
  url: 'https://github.com/eth-clients/hoodi',
  genesis: {
    difficulty: '0x01',
    extraData: '0x',
    gasLimit: '0x2255100',
    nonce: '0x0000000000001234',
    timestamp: '0x67d80ec0',
  },
  hardforks: [
    {
      name: 'chainstart',
      block: 0,
      forkHash: '0xbef71d30',
    },
  ],
  bootstrapNodes: [
    {
      ip: '134.209.138.84',
      port: 30303,
      id: '2112dd3839dd752813d4df7f40936f06829fc54c0e051a93967c26e5f5d27d99d886b57b4ffcc3c475e930ec9e79c56ef1dbb7d86ca5ee83a9d2ccf36e5c240c',
      location: '',
      comment: 'bootnode 1',
    },
    {
      ip: '209.38.124.160',
      port: 30303,
      id: '60203fcb3524e07c5df60a14ae1c9c5b24023ea5d47463dfae051d2c9f3219f309657537576090ca0ae641f73d419f53d8e8000d7a464319d4784acd7d2abc41',
      location: '',
      comment: 'bootnode 2',
    },
    {
      ip: '134.199.184.23',
      port: 30303,
      id: '8ae4a48101b2299597341263da0deb47cc38aa4d3ef4b7430b897d49bfa10eb1ccfe1655679b1ed46928ef177fbf21b86837bd724400196c508427a6f41602cd',
      location: '',
      comment: 'bootnode 3',
    },
  ],
  dnsNetworks: [
    'enrtree://AKA3AM6LPBYEUDMVNU3BSVQJ5AD45Y7YPOHJLEF6W26QOE4VTUDPE@all.hoodi.ethdisco.net',
  ],
}
