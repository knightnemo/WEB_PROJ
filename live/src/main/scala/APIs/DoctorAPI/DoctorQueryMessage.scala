package APIs.DoctorAPI

import Common.API.API
import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto._

case class DoctorQueryMessage(doctorName: String) extends API[DoctorInfo]("Doctor")

case class DoctorInfo(
                       userName: String,
                       bio: Option[String],
                       followers: Int,
                       following: Int,
                       reviewCount: Int
                     )

object DoctorInfo {
  implicit val encoder: Encoder[DoctorInfo] = deriveEncoder[DoctorInfo]
  implicit val decoder: Decoder[DoctorInfo] = deriveDecoder[DoctorInfo]
}