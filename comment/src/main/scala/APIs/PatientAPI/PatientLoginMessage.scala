package APIs.PatientAPI

case class PatientLoginMessage(userName:String, password:String) extends PatientMessage[String]
