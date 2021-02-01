import { EntitySchema } from 'typeorm';

import { WMATICvUSDCOHLVC } from '../models/WMATICvUSDCOHLVC';

export const WMATICvUSDCOHLVCEntity = new EntitySchema<WMATICvUSDCOHLVC>({
    name: 'WMATICvUSDCOHLVC',
    target: WMATICvUSDCOHLVC,
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
