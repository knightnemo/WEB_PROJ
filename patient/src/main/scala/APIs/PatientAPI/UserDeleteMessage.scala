package APIs.PatientAPI

case class UserDeleteMessage(userName: String) extends PatientMessage[String]