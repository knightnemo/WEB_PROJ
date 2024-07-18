import { LiveStreamMessage } from 'Plugins/LiveStreamAPI/LiveStreamMessage'

export class CreateLiveStreamMessage extends LiveStreamMessage {
    name: string;
    classroom: string;
    teacher: string;
    slot: number;

    constructor(name: string, classroom: string, teacher: string, slot: number) {
        super();
        this.name = name;
        this.classroom = classroom;
        this.teacher = teacher;
        this.slot = slot;
    }
}