package APIs.ClassroomAPI

import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto._

case class CheckClassroomAvailabilityMessage(name: String, slotNumber: Int) extends ClassroomMessage[Boolean]

object CheckClassroomAvailabilityMessage {
  implicit val decoder: Decoder[CheckClassroomAvailabilityMessage] = deriveDecoder[CheckClassroomAvailabilityMessage]
  implicit val encoder: Encoder[CheckClassroomAvailabilityMessage] = deriveEncoder[CheckClassroomAvailabilityMessage]
}