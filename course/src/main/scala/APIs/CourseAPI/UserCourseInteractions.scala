package APIs.CourseAPI

import Common.API.PlanContext
import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}

// 简化的 User 类型
case class User(username: String)

object User {
  implicit val decoder: Decoder[User] = deriveDecoder[User]
  implicit val encoder: Encoder[User] = deriveEncoder[User]
}

case class GetUserFavoriteCoursesMessage(userName: String, planContext: PlanContext) extends CourseMessage[List[Course]]
case class GetUserRatedCoursesMessage(userName: String, planContext: PlanContext) extends CourseMessage[List[(Course, Int)]]
case class GetUserEnrolledCoursesMessage(userName: String, planContext: PlanContext) extends CourseMessage[List[Course]]
case class GetCourseEnrolledUsersMessage(courseId: String, planContext: PlanContext) extends CourseMessage[List[User]]
case class GetCourseRatingUsersMessage(courseId: String, planContext: PlanContext) extends CourseMessage[List[(User, Int)]]
case class GetCourseFavoritedUsersMessage(courseId: String, planContext: PlanContext) extends CourseMessage[List[User]]

object UserCourseInteractions {
  implicit val getUserFavoriteCoursesMessageDecoder: Decoder[GetUserFavoriteCoursesMessage] = deriveDecoder
  implicit val getUserFavoriteCoursesMessageEncoder: Encoder[GetUserFavoriteCoursesMessage] = deriveEncoder

  implicit val getUserRatedCoursesMessageDecoder: Decoder[GetUserRatedCoursesMessage] = deriveDecoder
  implicit val getUserRatedCoursesMessageEncoder: Encoder[GetUserRatedCoursesMessage] = deriveEncoder

  implicit val getUserEnrolledCoursesMessageDecoder: Decoder[GetUserEnrolledCoursesMessage] = deriveDecoder
  implicit val getUserEnrolledCoursesMessageEncoder: Encoder[GetUserEnrolledCoursesMessage] = deriveEncoder

  implicit val getCourseEnrolledUsersMessageDecoder: Decoder[GetCourseEnrolledUsersMessage] = deriveDecoder
  implicit val getCourseEnrolledUsersMessageEncoder: Encoder[GetCourseEnrolledUsersMessage] = deriveEncoder

  implicit val getCourseRatingUsersMessageDecoder: Decoder[GetCourseRatingUsersMessage] = deriveDecoder
  implicit val getCourseRatingUsersMessageEncoder: Encoder[GetCourseRatingUsersMessage] = deriveEncoder

  implicit val getCourseFavoritedUsersMessageDecoder: Decoder[GetCourseFavoritedUsersMessage] = deriveDecoder
  implicit val getCourseFavoritedUsersMessageEncoder: Encoder[GetCourseFavoritedUsersMessage] = deriveEncoder
}