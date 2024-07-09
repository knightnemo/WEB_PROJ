// ChangePatientBioMessage.scala
package APIs.PatientAPI

case class ChangePatientBioMessage(userName: String, newBio: String) extends PatientMessage[String]
