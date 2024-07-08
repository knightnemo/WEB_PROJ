package APIs.CourseAPI

import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto.*

case class Course(
                   id: String,
                   title: String,
                   instructor: String,
                   description: String,
                   rating: String,
                   image_url: String,
                   resource_url: String,
                   duration_minutes: Int,
                   difficulty_level: String,
                   category: String,
                   subcategory: Option[String],
                   language: String,
                   prerequisites: List[String],
                   learning_objectives: List[String]
                 )

object Course {
  implicit val courseEncoder: Encoder[Course] = deriveEncoder[Course]
  implicit val courseDecoder: Decoder[Course] = deriveDecoder[Course]
}