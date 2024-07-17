import { LiveStreamMessage } from 'Plugins/LiveStreamAPI/LiveStreamMessage'

export class UpdateLiveStreamMessage extends LiveStreamMessage {
    name: string;
    capacity: number;
    slot1: string;
    slot2: string;
    slot3: string;
    slot4: string;
    slot5: string;
    slot6: string;
    slot7: string;
    slot8: string;

    constructor(name: string, capacity: number, slots: string[]) {
        super();
        this.name = name;
        this.capacity = capacity;
        [this.slot1, this.slot2, this.slot3, this.slot4, this.slot5, this.slot6, this.slot7, this.slot8] = slots;
    }
}