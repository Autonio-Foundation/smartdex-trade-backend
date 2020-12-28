import { EntitySchema } from 'typeorm';

import { WMATICvUSDTOHLVC } from '../models/WMATICvUSDTOHLVC';

export const WMATICvUSDTOHLVCEntity = new EntitySchema<WMATICvUSDTOHLVC>({
    name: 'WMATICvUSDTOHLVC',
    target: WMATICvUSDTOHLVC,
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
