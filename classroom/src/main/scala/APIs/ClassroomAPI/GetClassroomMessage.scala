package APIs.ClassroomAPI

case class GetClassroomMessage(name: String) extends ClassroomMessage[ClassroomInfo]