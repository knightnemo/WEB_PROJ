package APIs.PatientAPI

case class PatientRegisterMessage(userName: String, bio: Option[String]) extends PatientMessage[Int]
