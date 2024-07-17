import { LiveStreamMessage } from 'Plugins/LiveStreamAPI/LiveStreamMessage'

export class GetLiveStreamMessage extends LiveStreamMessage {
    name: string;

    constructor(name: string) {
        super();
        this.name = name;
    }
}