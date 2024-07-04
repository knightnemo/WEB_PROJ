package APIs.DoctorAPI

case class AddPatientMessage(doctorName:String, patientName:String) extends DoctorMessage[String]
