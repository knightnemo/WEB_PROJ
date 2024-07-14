package Impl

import cats.effect.IO
import io.circe.generic.auto._
import Common.API.{PlanContext, Planner}
import Common.DBAPI._
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.CourseAPI._

case class GetUserFavoriteCoursesPlanner(userName: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    readDBRows(
      s"""
      SELECT c.* FROM ${schemaName}.courses c
      JOIN ${schemaName}.course_favorites f ON c.id = f.course_name
      WHERE f.user_name = ?
      """,
      List(SqlParameter("String", userName))
    ).map(results => if (results.isEmpty) "[]" else results.toString)
  }

case class GetUserRatedCoursesPlanner(userName: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    readDBRows(
      s"""
      SELECT c.*, r.rating FROM ${schemaName}.courses c
      JOIN ${schemaName}.course_ratings r ON c.id = r.course_name
      WHERE r.user_name = ?
      """,
      List(SqlParameter("String", userName))
    ).map(results => if (results.isEmpty) "[]" else results.toString)
  }

case class GetUserEnrolledCoursesPlanner(userName: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    readDBRows(
      s"""
      SELECT c.* FROM ${schemaName}.courses c
      JOIN ${schemaName}.user_course uc ON c.id = uc.course_name
      WHERE uc.user_name = ?
      """,
      List(SqlParameter("String", userName))
    ).map(results => if (results.isEmpty) "[]" else results.toString)
  }

case class GetCourseEnrolledUsersPlanner(courseId: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    readDBRows(
      s"""
      SELECT DISTINCT user_name FROM ${schemaName}.user_course
      WHERE course_name = ?
      """,
      List(SqlParameter("String", courseId))
    ).map(results => if (results.isEmpty) "[]" else results.toString)
  }

case class GetCourseRatingUsersPlanner(courseId: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    readDBRows(
      s"""
      SELECT user_name, rating FROM ${schemaName}.course_ratings
      WHERE course_name = ?
      """,
      List(SqlParameter("String", courseId))
    ).map(results => if (results.isEmpty) "[]" else results.toString)
  }

case class GetCourseFavoritedUsersPlanner(courseId: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    readDBRows(
      s"""
      SELECT DISTINCT user_name FROM ${schemaName}.course_favorites
      WHERE course_name = ?
      """,
      List(SqlParameter("String", courseId))
    ).map(results => if (results.isEmpty) "[]" else results.toString)
  }