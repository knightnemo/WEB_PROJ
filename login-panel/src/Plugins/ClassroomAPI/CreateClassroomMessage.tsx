import { ClassroomMessage } from 'Plugins/ClassroomAPI/ClassroomMessage'

export class CreateClassroomMessage extends ClassroomMessage {
    name: string;
    capacity: number;

    constructor(name: string, capacity: number) {
        super();
        this.name = name;
        this.capacity = capacity;
    }
}