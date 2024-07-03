import { DoctorMessage } from 'Plugins/DoctorAPI/DoctorMessage'

export class AddPatientMessage extends DoctorMessage{
    doctorName: string;
    patientName: string;

    constructor(doctorName:string, patientName:string) {
        super();
        this.doctorName = doctorName;
        this.patientName = patientName;
    }
}
