package APIs.ClassroomAPI

import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto._

case class ClassroomInfo(
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

object ClassroomInfo {
  implicit val decoder: Decoder[ClassroomInfo] = deriveDecoder[ClassroomInfo]
  implicit val encoder: Encoder[ClassroomInfo] = deriveEncoder[ClassroomInfo]
}