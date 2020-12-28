import { EntitySchema } from 'typeorm';

import { NIOXvUSDTOHLVC } from '../models/NIOXvUSDTOHLVC';

export const NIOXvUSDTOHLVCEntity = new EntitySchema<NIOXvUSDTOHLVC>({
    name: 'NIOXvUSDTOHLVC',
    target: NIOXvUSDTOHLVC,
    columns: {
        dt: {
            primary: true,
            type: 'int',
        },
        bid: {
            type: 'int',
        },
        ask: {
            type: 'int',
        },
        bid_vol: {
            type: 'int',
        },
        ask_vol: {
            type: 'int',
        },
    },
});
