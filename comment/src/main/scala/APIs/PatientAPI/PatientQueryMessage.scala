package APIs.PatientAPI

case class PatientQueryMessage(doctorName:String, patientName:String) extends PatientMessage[String]
