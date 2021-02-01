import { EntitySchema } from 'typeorm';

import { USDTvUSDCOHLVC } from '../models/USDTvUSDCOHLVC';

export const WMATICvUSDCOHLVCEntity = new EntitySchema<USDTvUSDCOHLVC>({
    name: 'USDTvUSDCOHLVC',
    target: USDTvUSDCOHLVC,
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
