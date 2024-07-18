import { ClassroomMessage } from 'Plugins/ClassroomAPI/ClassroomMessage'

export class OccupyClassroomSlotMessage extends ClassroomMessage {
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