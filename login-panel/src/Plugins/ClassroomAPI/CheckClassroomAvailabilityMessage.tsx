import { ClassroomMessage } from 'Plugins/ClassroomAPI/ClassroomMessage'

export class CheckClassroomAvailabilityMessage extends ClassroomMessage {
    name: string;
    slotNumber: number;

    constructor(name: string, slotNumber: number) {
        super();
        this.name = name;
        this.slotNumber = slotNumber;
    }
}