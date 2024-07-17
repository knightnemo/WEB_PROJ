package APIs.ClassroomAPI

case class CheckClassroomAvailabilityMessage(name: String, slotNumber: Int) extends ClassroomMessage[Boolean]