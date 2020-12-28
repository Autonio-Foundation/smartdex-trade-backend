export class NIOXvUSDTOHLVC {
    public dt?: number;
    public bid?: number;
    public ask?: number;
    public bid_vol?: number;
    public ask_vol?: number;
    constructor(
        opts: {
            dt?: number;
            bid?: number;
            ask?: number;
            bid_vol?: number;
            ask_vol?: number;
        } = {},
    ) {
        this.dt = opts.dt;
        this.bid = opts.bid;
        this.ask = opts.ask;
        this.bid_vol = opts.bid_vol;
        this.ask_vol = opts.ask_vol;
    }
}
