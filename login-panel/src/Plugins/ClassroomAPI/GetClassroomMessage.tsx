import { ClassroomMessage } from 'Plugins/ClassroomAPI/ClassroomMessage'

export class GetClassroomMessage extends ClassroomMessage {
    name: string;

    constructor(name: string) {
        super();
        this.name = name;
    }
}