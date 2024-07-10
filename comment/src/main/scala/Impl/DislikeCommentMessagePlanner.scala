package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.{writeDB, *}
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.CommentAPI.DislikeCommentMessage

case class DislikeCommentMessagePlanner(msg: DislikeCommentMessage, override val planContext: PlanContext) extends Planner[Boolean]:
  override def plan(using planContext: PlanContext): IO[Boolean] = {
    val updateQuery = s"""
      UPDATE ${schemaName}.comments 
      SET dislikes = (COALESCE(NULLIF(dislikes, ''), '0')::integer + 1)::text 
      WHERE id = ?
    """
    val params = List(SqlParameter("String", msg.id))

    writeDB(updateQuery, params).map(_ > "0")
  }