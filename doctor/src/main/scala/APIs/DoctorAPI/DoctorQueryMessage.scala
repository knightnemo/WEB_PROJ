package APIs.DoctorAPI

import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto._

case class DoctorInfo(
                       userName: String,
                       bio: String,
                       followers: Int,
                       following: Int,
                       reviewCount: Int,
                       slot1: String,
                       slot2: String,
                       slot3: String,
                       slot4: String,
                       slot5: String,
                       slot6: String,
                       slot7: String,
                       slot8: String
                     )

object DoctorInfo {
  implicit val decoder: Decoder[DoctorInfo] = deriveDecoder[DoctorInfo]
  implicit val encoder: Encoder[DoctorInfo] = deriveEncoder[DoctorInfo]
}