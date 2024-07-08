package APIs.CourseAPI

import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto._

case class Course(
                   id: String,
                   tag: String,
                   title: String,
                   instructor: String,
                   description: String,
                   rating: Double,
                   image_url: String,
                   resource_url: String,
                 )

object Course {
  implicit val courseEncoder: Encoder[Course] = deriveEncoder[Course]
  implicit val courseDecoder: Decoder[Course] = deriveDecoder[Course]
}