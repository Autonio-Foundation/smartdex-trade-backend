import { EntitySchema } from 'typeorm';

import { NIOXvUSDCOHLVC } from '../models/NIOXvUSDCOHLVC';

export const NIOXvUSDCOHLVCEntity = new EntitySchema<NIOXvUSDCOHLVC>({
    name: 'NIOXvUSDCOHLVC',
    target: NIOXvUSDCOHLVC,
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
