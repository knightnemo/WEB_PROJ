package Impl

import cats.effect.IO
import io.circe.generic.auto._
import io.circe.Json
import Common.API.{PlanContext, Planner}
import Common.DBAPI._
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.CourseAPI.{UserCourseMessage, UserCourseInteraction}

import scala.language.postfixOps

case class UserCourseMessagePlanner(
                                     userName: String,
                                     courseId: String,
                                     action: String,
                                     rating: Option[Int],
                                     override val planContext: PlanContext
                                   ) extends Planner[UserCourseInteraction]:

  override def plan(using PlanContext): IO[UserCourseInteraction] = {
    action match {
      case "FavoriteCourse" => favoriteCourse()
      case "RateCourse" if rating.isDefined => rateCourse(rating.get)
      case "GetInteraction" => getUserInteraction()
      case "EnrollCourse" => enrollInCourse()
      case _ => IO.raiseError(new IllegalArgumentException(s"Invalid action: $action"))
    }
  }

  private def getUserInteraction()(using planContext: PlanContext): IO[UserCourseInteraction] = {
    for {
      isEnrolled <- isUserEnrolled()
      favoriteInfo <- getUserFavorite()
      ratingInfo <- getUserRating()
    } yield UserCourseInteraction(
      isFavorite = favoriteInfo.isDefined,
      rating = ratingInfo.map(_._1),
      isEnrolled = isEnrolled
    )
  }

  private def isUserEnrolled()(using planContext: PlanContext): IO[Boolean] = {
    readDBBoolean(
      s"""
      SELECT EXISTS (
        SELECT 1 FROM ${schemaName}.user_course
        WHERE user_name = ? AND course_name = ?
      )
      """,
      List(SqlParameter("String", userName), SqlParameter("String", courseId))
    )
  }

  private def getUserFavorite()(using planContext: PlanContext): IO[Option[Json]] = {
    readDBRows(
      s"""
      SELECT favorite_date FROM ${schemaName}.course_favorites
      WHERE user_name = ? AND course_name = ?
      """,
      List(SqlParameter("String", userName), SqlParameter("String", courseId))
    ).map(_.headOption)
  }

  private def getUserRating()(using planContext: PlanContext): IO[Option[(Int, Json)]] = {
    readDBRows(
      s"""
      SELECT rating, rating_date FROM ${schemaName}.course_ratings
      WHERE user_name = ? AND course_name = ?
      """,
      List(SqlParameter("String", userName), SqlParameter("String", courseId))
    ).map(_.headOption.map(json => (decodeField[Int](json, "rating"), json)))
  }

  private def enrollInCourse()(using planContext: PlanContext): IO[UserCourseInteraction] = {
    for {
      _ <- writeDB(
        s"""
        INSERT INTO ${schemaName}.user_course (user_name, course_name)
        VALUES (?, ?)
        ON CONFLICT (user_name, course_name) DO NOTHING
        """,
        List(SqlParameter("String", userName), SqlParameter("String", courseId))
      )
      result <- getUserInteraction()
    } yield result
  }

  private def rateCourse(rating: Int)(using planContext: PlanContext): IO[UserCourseInteraction] = {
    for {
      _ <- writeDB(
        s"""
        INSERT INTO ${schemaName}.course_ratings (user_name, course_name, rating)
        VALUES (?, ?, ?)
        ON CONFLICT (user_name, course_name) DO UPDATE SET rating = EXCLUDED.rating, rating_date = CURRENT_TIMESTAMP
        """,
        List(SqlParameter("String", userName), SqlParameter("String", courseId), SqlParameter("Int", rating.toString))
      )
      _ <- updateCourseRating(courseId)
      result <- getUserInteraction()
    } yield result
  }

  private def favoriteCourse()(using planContext: PlanContext): IO[UserCourseInteraction] = {
    for {
      currentFavorite <- getUserFavorite()
      _ <- if (currentFavorite.isDefined) {
        writeDB(
          s"""
          DELETE FROM ${schemaName}.course_favorites
          WHERE user_name = ? AND course_name = ?
          """,
          List(SqlParameter("String", userName), SqlParameter("String", courseId))
        )
      } else {
        writeDB(
          s"""
          INSERT INTO ${schemaName}.course_favorites (user_name, course_name)
          VALUES (?, ?)
          """,
          List(SqlParameter("String", userName), SqlParameter("String", courseId))
        )
      }
      result <- getUserInteraction()
    } yield result
  }

  private def updateCourseRating(courseId: String)(using planContext: PlanContext): IO[Unit] = {
    writeDB(
      s"""
      UPDATE ${schemaName}.courses
      SET rating = (
        SELECT AVG(rating)::TEXT
        FROM ${schemaName}.course_ratings
        WHERE course_name = ?
      )
      WHERE id = ?
      """,
      List(SqlParameter("String", courseId), SqlParameter("String", courseId))
    ).void
  }