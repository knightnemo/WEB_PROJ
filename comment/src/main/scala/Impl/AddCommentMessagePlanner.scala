package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.{writeDB, *}
import Common.Object.{ParameterList, SqlParameter}
import Common.ServiceUtils.schemaName
import APIs.CommentAPI.AddCommentMessage

import java.util.UUID

case class AddCommentMessagePlanner(msg: AddCommentMessage, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using planContext: PlanContext): IO[String] = {
    val commentId = UUID.randomUUID().toString
    val createdAt = System.currentTimeMillis()
    val insertQuery = s"""
      INSERT INTO ${schemaName}.comments 
      (id, course_id, user_id, content, likes, dislikes, created_at, parent_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """
    val params = List(
      SqlParameter("String", commentId),
      SqlParameter("String", msg.courseId),
      SqlParameter("String", msg.userId),
      SqlParameter("String", msg.content),
      SqlParameter("String", "0"),  // 初始likes为0
      SqlParameter("String", "0"),  // 初始dislikes为0
      SqlParameter("String", createdAt.toString),
      SqlParameter("String", msg.parentId.orNull)
    )

    writeDB(insertQuery, params).map(_ => "Comment added successfully")
  }