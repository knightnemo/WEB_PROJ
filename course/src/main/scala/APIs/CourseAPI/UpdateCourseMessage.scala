package APIs.CourseAPI

case class UpdateCourseMessage(
                                id: String,
                                title: Option[String],
                                instructor: Option[String],
                                description: Option[String],
                                rating: Option[String],
                                image_url: Option[String],
                                resource_url: Option[String],
                                duration_minutes: Option[Int],
                                difficulty_level: Option[String],
                                category: Option[String],
                                subcategory: Option[String],
                                language: Option[String],
                                prerequisites: Option[List[String]],
                                learning_objectives: Option[List[String]]
                              ) extends CourseMessage[Boolean]