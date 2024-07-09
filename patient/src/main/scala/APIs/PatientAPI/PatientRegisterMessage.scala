package APIs.PatientAPI

case class PatientRegisterMessage(userName: String, password: String, bio: Option[String], gender: Option[String]) extends PatientMessage[String]
