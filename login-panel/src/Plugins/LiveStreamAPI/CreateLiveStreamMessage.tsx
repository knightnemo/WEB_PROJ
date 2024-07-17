import { LiveStreamMessage } from 'Plugins/LiveStreamAPI/LiveStreamMessage'

export class CreateLiveStreamMessage extends LiveStreamMessage {
    name: string;
    capacity: number;

    constructor(name: string, capacity: number) {
        super();
        this.name = name;
        this.capacity = capacity;
    }
}