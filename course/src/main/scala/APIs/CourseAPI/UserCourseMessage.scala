package APIs.CourseAPI

import io.circe.{Decoder, Encoder, Json}
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}
import Common.API.PlanContext

case class UserCourseMessage(
                              userName: String,
                              courseId: String,
                              action: String,
                              rating: Option[Int] = None,
                              planContext: PlanContext
                            ) extends CourseMessage[UserCourseInteraction]

case class UserCourseInteraction(
                                  isFavorite: Boolean,
                                  rating: Option[Int],
                                  isEnrolled: Boolean
                                )

object UserCourseInteraction {
  implicit val decoder: Decoder[UserCourseInteraction] = deriveDecoder[UserCourseInteraction]
  implicit val encoder: Encoder[UserCourseInteraction] = deriveEncoder[UserCourseInteraction]
}
