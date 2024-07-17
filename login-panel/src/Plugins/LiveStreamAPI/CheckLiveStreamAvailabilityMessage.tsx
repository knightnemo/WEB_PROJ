import { LiveStreamMessage } from 'Plugins/LiveStreamAPI/LiveStreamMessage'

export class CheckLiveStreamAvailabilityMessage extends LiveStreamMessage {
    name: string;
    slotNumber: number;

    constructor(name: string, slotNumber: number) {
        super();
        this.name = name;
        this.slotNumber = slotNumber;
    }
}