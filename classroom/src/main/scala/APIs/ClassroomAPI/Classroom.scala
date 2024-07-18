package APIs.ClassroomAPI

import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto.*

case class Classroom(
                      id: String,
                      name: String,
                      capacity: Int,
                      slot1: String,
                      slot2: String,
                      slot3: String,
                      slot4: String,
                      slot5: String,
                      slot6: String,
                      slot7: String,
                      slot8: String
                    )

object Classroom {
  implicit val classroomEncoder: Encoder[Classroom] = deriveEncoder[Classroom]
  implicit val classroomDecoder: Decoder[Classroom] = deriveDecoder[Classroom]
}