package APIs.CourseAPI

import java.time.LocalDateTime

case class AddCourseMessage(
                             id: String,
                             title: String,
                             instructor: String,
                             description: String,
                             rating: Double,
                             image_url: String,
                             resource_url: String,
                             duration_minutes: Int,
                             difficulty_level: String,
                             category: String,
                             subcategory: Option[String],
                             language: String,
                             prerequisites: List[String],
                             learning_objectives: List[String]
                           ) extends CourseMessage[String] {
  val created_at: LocalDateTime = LocalDateTime.now()
  val updated_at: LocalDateTime = created_at
}