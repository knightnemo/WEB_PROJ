package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import io.circe.{Encoder, Json}
import io.circe.syntax.*
import APIs.CommentAPI.{GetCommentsMessage, Comment}

case class GetCommentsMessagePlanner(msg: GetCommentsMessage, override val planContext: PlanContext) extends Planner[String]:
  // 在这里实现 Comment 的 Encoder
  implicit val commentEncoder: Encoder[Comment] = new Encoder[Comment] {
    final def apply(c: Comment): Json = Json.obj(
      ("id", Json.fromString(c.id)),
      ("courseId", Json.fromString(c.courseId)),
      ("userId", Json.fromString(c.userId)),
      ("content", Json.fromString(c.content)),
      ("likes", Json.fromString(c.likes)),
      ("dislikes", Json.fromString(c.dislikes)),
      ("createdAt", Json.fromString(c.createdAt)),
      ("parentId", c.parentId.map(Json.fromString).getOrElse(Json.Null)),
      ("replies", Json.fromValues(c.replies.map(apply)))
    )
  }

  override def plan(using PlanContext): IO[String] = {
    val query = s"""
      SELECT id, course_id, user_id, content, likes, dislikes, created_at, parent_id
      FROM ${schemaName}.comments
      WHERE course_id = ?
      ORDER BY created_at DESC
    """
    val params = List(SqlParameter("String", msg.courseId))

    writeDB(query, params).flatMap { result =>
      if (result == "0") IO.pure("[]") // 没有找到评论，返回空数组
      else {
        // 假设 writeDB 返回的是一个包含所有评论的 JSON 字符串
        // 解析 JSON 字符串为 Comment 对象列表
        IO.fromEither(io.circe.parser.decode[List[Comment]](result))
          .flatMap(buildCommentTree)
          .map(_.asJson.noSpaces) // 将评论树转换回 JSON 字符串
      }
    }
  }

  private def buildCommentTree(comments: List[Comment]): IO[List[Comment]] = IO {
    val commentMap = comments.map(c => c.id -> c).toMap
    val rootComments = comments.filter(_.parentId.isEmpty)

    def addReplies(comment: Comment): Comment = {
      val replies = comments.filter(_.parentId.contains(comment.id))
      comment.copy(replies = replies.map(addReplies))
    }

    rootComments.map(addReplies)
  }