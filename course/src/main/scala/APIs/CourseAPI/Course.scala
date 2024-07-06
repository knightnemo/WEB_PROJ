package APIs.CourseAPI

import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto._

case class Course(
                   id: String,
                   title: String,
                   instructor: String,
                   description: String,
                   rating: Double,
                   reviews: Int
                 )

object Course {
  implicit val courseEncoder: Encoder[Course] = deriveEncoder[Course]
  implicit val courseDecoder: Decoder[Course] = deriveDecoder[Course]
}