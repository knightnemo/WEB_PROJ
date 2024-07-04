package APIs.DoctorAPI

case class DeletePatientMessage(doctorName:String, patientName:String) extends DoctorMessage[String]
