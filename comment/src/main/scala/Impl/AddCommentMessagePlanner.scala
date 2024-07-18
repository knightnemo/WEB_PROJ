package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName

import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.UUID

case class AddCommentMessagePlanner(
                                     courseId: String,
                                     userId: String,
                                     content: String,
                                     rating: Int,
                                     override val planContext: PlanContext
                                   ) extends Planner[String]:

  override def plan(using PlanContext): IO[String] = {
    val commentId = UUID.randomUUID().toString
    val createdAt = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

    writeDB(
      s"""INSERT INTO ${schemaName}.comments
         |(id, course_id, user_id, content, rating, created_at, upvotes, downvotes)
         |VALUES (?, ?, ?, ?, ?, ?, ?, ?)""".stripMargin,
      List(
        SqlParameter("String", commentId),
        SqlParameter("String", courseId),
        SqlParameter("String", userId),
        SqlParameter("String", content),
        SqlParameter("Int", rating.toString),
        SqlParameter("String", createdAt),
        SqlParameter("Int", "0"),
        SqlParameter("Int", "0")
      )
    ).attempt.flatMap {
      case Right(_) => IO.pure(s"Comment added successfully with ID: $commentId")
      case Left(error) =>
        IO.raiseError(new Exception(s"Failed to add comment: ${error.getMessage}"))
    }
  }