// ChangeBioMessage.scala
package APIs.DoctorAPI

case class ChangeBioMessage(userName: String, newBio: String) extends DoctorMessage[String]