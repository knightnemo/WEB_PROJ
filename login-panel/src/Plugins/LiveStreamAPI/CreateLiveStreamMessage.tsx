import { LiveStreamMessage } from 'Plugins/LiveStreamAPI/LiveStreamMessage'

export class CreateLiveStreamMessage extends LiveStreamMessage {
    name: string;
    classroom: string;
    teacher: string;
    slot: number;
    capacity: number;  // 新增字段

    constructor(name: string, classroom: string, teacher: string, slot: number, capacity: number) {
        super();
        this.name = name;
        this.classroom = classroom;
        this.teacher = teacher;
        this.slot = slot;
        this.capacity = capacity;  // 新增字段
    }
}