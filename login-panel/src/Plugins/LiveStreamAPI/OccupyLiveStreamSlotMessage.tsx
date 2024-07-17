import { LiveStreamMessage } from 'Plugins/LiveStreamAPI/LiveStreamMessage'

export class OccupyLiveStreamSlotMessage extends LiveStreamMessage {
    name: string;
    slotNumber: number;
    courseName: string;

    constructor(name: string, slotNumber: number, courseName: string) {
        super();
        this.name = name;
        this.slotNumber = slotNumber;
        this.courseName = courseName;
    }
}