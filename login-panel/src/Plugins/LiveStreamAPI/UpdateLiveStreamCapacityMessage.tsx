import { LiveStreamMessage } from 'Plugins/LiveStreamAPI/LiveStreamMessage'

export class UpdateLiveStreamCapacityMessage extends LiveStreamMessage {
    liveStreamId: string;
    slotNumber: number;
    userName: string;

    constructor(liveStreamId: string, slotNumber: number, userName: string) {
        super();
        this.liveStreamId = liveStreamId;
        this.slotNumber = slotNumber;
        this.userName = userName;
    }
}