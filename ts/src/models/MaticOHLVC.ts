export class MaticOHLVC {
    public dt?: number;
    public base_token?: string;
    public quote_token?: string;
    public bid?: number;
    public ask?: number;
    public bid_vol?: number;
    public ask_vol?: number;
    constructor(
        opts: {
            dt?: number;
            base_token?: string;
            quote_token?: string;
            bid?: number;
            ask?: number;
            bid_vol?: number;
            ask_vol?: number;
        } = {},
    ) {
        this.dt = opts.dt;
        this.base_token = opts.base_token;
        this.quote_token = opts.quote_token;
        this.bid = opts.bid;
        this.ask = opts.ask;
        this.bid_vol = opts.bid_vol;
        this.ask_vol = opts.ask_vol;
    }
}
