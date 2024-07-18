package Impl

import Common.API.{PlanContext, Planner}
import Common.DBAPI.ReadDBRowsMessage
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.CommentAPI.{GetCourseCommentsMessage, CommentInfo}
import cats.effect.IO
import io.circe.generic.auto._
import io.circe.parser._
import cats.syntax.traverse._
import cats.instances.list._

case class GetCourseCommentsMessagePlanner(message: GetCourseCommentsMessage, override val planContext: PlanContext) extends Planner[List[CommentInfo]]:
  override def plan(using PlanContext): IO[List[CommentInfo]] = {
    val GetCourseCommentsMessage(courseId, page, pageSize) = message
    val offset = (page - 1) * pageSize

    val readMessage = ReadDBRowsMessage(
      s"""
         |SELECT id, user_id AS userid, content, rating, created_at AS createdat, upvotes, downvotes
         |FROM ${schemaName}.comments
         |WHERE course_id = ?
         |ORDER BY created_at DESC
         |LIMIT ? OFFSET ?
      """.stripMargin,
      List(
        SqlParameter("String", courseId),
        SqlParameter("Int", pageSize.toString),
        SqlParameter("Int", offset.toString)
      )
    )

    readMessage.send.flatMap { rows =>
      IO.fromEither(
        rows.traverse { row =>
          for {
            id <- row.hcursor.get[String]("id")
            userId <- row.hcursor.get[String]("userid")  // 改为小写 "userid"
            content <- row.hcursor.get[String]("content")
            rating <- row.hcursor.get[Int]("rating")
            createdAt <- row.hcursor.get[String]("createdat")  // 改为小写 "createdat"
            upvotes <- row.hcursor.get[Int]("upvotes")
            downvotes <- row.hcursor.get[Int]("downvotes")
          } yield CommentInfo(id, userId, content, rating, createdAt, upvotes, downvotes)
        }
      )
    }
  }